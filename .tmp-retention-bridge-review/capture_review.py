#!/usr/bin/env python3
"""Capture the synthetic retention bridge through production components."""

import json
import os
import struct
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Page, Route, sync_playwright


BASE_URL = os.environ.get(
    "RETENTION_REVIEW_BASE_URL",
    "http://127.0.0.1:4173",
).rstrip("/")
REVIEW_PATH = "/retention-bridge-review-dev"
OUTPUT_ROOT = Path(__file__).resolve().parent
SCREENSHOT_DIRECTORY = OUTPUT_ROOT / "screenshots"

VIEWPORTS = {
    "phone-390x844": {"width": 390, "height": 844},
    "desktop-1440x900": {"width": 1440, "height": 900},
}

EXPECTED_BUILD_BODY = {
    "childId": "11111111-1111-4111-8111-111111111111",
    "subjectId": "literacy",
}
EXPECTED_KEEP_BODY = {
    "lessonId": "33333333-3333-4333-8333-333333333333",
}
EXPECTED_RETRY_BODY = {
    "lessonId": "33333333-3333-4333-8333-333333333333",
}


def parse_json_body(route: Route) -> dict[str, object]:
    post_data = route.request.post_data
    if post_data is None:
        raise AssertionError(f"Expected a JSON body for {route.request.url}")
    value = json.loads(post_data)
    if not isinstance(value, dict):
        raise AssertionError(f"Expected an object body for {route.request.url}")
    return value


def png_dimensions(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    if header[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(f"Expected a PNG screenshot: {path}")
    return struct.unpack(">II", header[16:24])


def capture_viewport_screenshot(
    page: Page,
    screenshot_name: str,
    expected_viewport: dict[str, int],
) -> dict[str, object]:
    path = SCREENSHOT_DIRECTORY / f"{screenshot_name}.png"
    page.screenshot(
        path=str(path),
        full_page=False,
        animations="disabled",
    )
    width, height = png_dimensions(path)
    expected_dimensions = (
        expected_viewport["width"],
        expected_viewport["height"],
    )
    if (width, height) != expected_dimensions:
        raise AssertionError(
            f"{path.name} is {width}x{height}, expected "
            f"{expected_dimensions[0]}x{expected_dimensions[1]}",
        )
    return {
        "path": str(path.relative_to(OUTPUT_ROOT)),
        "width": width,
        "height": height,
    }


def wait_for_review_page(page: Page) -> None:
    page.wait_for_load_state("networkidle")
    page.locator("body").wait_for(state="visible")
    page.add_style_tag(content="nextjs-portal { display: none !important; }")


def open_review_state(page: Page, state: str) -> None:
    page.goto(
        f"{BASE_URL}{REVIEW_PATH}?state={state}",
        wait_until="domcontentloaded",
        timeout=60_000,
    )
    wait_for_review_page(page)


def center_element(page: Page, selector: str) -> None:
    locator = page.locator(selector)
    locator.wait_for(state="visible")
    locator.evaluate(
        "element => element.scrollIntoView({ block: 'center', inline: 'nearest' })",
    )
    page.wait_for_timeout(150)


def capture_retention_states(
    page: Page,
    viewport_name: str,
    viewport: dict[str, int],
    request_log: list[dict[str, object]],
) -> list[dict[str, object]]:
    screenshots: list[dict[str, object]] = []

    open_review_state(page, "report")
    page.locator("details#subject-literacy > summary").click()
    build_button = page.get_by_role("button", name="Build the next lesson")
    build_button.wait_for(state="visible")
    center_element(page, "button:has-text('Build the next lesson')")
    screenshots.append(
        capture_viewport_screenshot(
            page,
            f"01-report-build-{viewport_name}",
            viewport,
        ),
    )
    build_button.click()
    page.wait_for_url("**state=wait", timeout=30_000)
    wait_for_review_page(page)
    page.get_by_role(
        "heading",
        name="HOMA is making the lesson and worksheet",
    ).wait_for()
    page.get_by_text("This is the goal for this lesson.").wait_for()
    page.get_by_text("This page updates when both are ready.").wait_for()
    page.get_by_text(
        "You can leave and come back. Your request is saved.",
    ).wait_for()
    screenshots.append(
        capture_viewport_screenshot(
            page,
            f"02-wait-{viewport_name}",
            viewport,
        ),
    )

    open_review_state(page, "ready")
    page.get_by_text("This is the goal for this lesson.").wait_for()
    page.get_by_role("heading", name="Worksheet", exact=True).wait_for()
    page.get_by_role("link", name="Print it").wait_for()
    page.get_by_text(
        "Binder saves the worksheet for later. The lesson stays at this link.",
    ).wait_for()
    if page.get_by_text("Worksheet ready", exact=True).count() != 0:
        raise AssertionError("Ready state repeats the worksheet heading")
    keep_button = page.get_by_role("button", name="Keep in Binder")
    keep_button.wait_for(state="visible")
    page.locator("img[alt=\"Preview of Maya's uppercase letter practice\"]").wait_for(
        state="visible",
    )
    center_element(page, "button:has-text('Keep in Binder')")
    screenshots.append(
        capture_viewport_screenshot(
            page,
            f"03-ready-draft-{viewport_name}",
            viewport,
        ),
    )
    keep_button.click()
    kept_heading = page.get_by_role("heading", name="Kept in Binder")
    kept_heading.wait_for(state="visible")
    if page.evaluate("document.activeElement?.textContent?.trim()") != "Kept in Binder":
        raise AssertionError("Successful Keep did not focus the kept heading")
    page.get_by_role(
        "link",
        name="Message HOMA about this lesson",
    ).wait_for(state="visible")
    page.get_by_text(
        "HOMA can help you adjust the lesson or talk through how it went.",
    ).wait_for(state="visible")
    page.get_by_text(
        "Phone setup is optional. HOMA sends one research note by text each "
        "weekday morning.",
    ).wait_for(state="visible")
    page.get_by_role("heading", name="Prefer text?").wait_for(state="visible")
    phone_settings_link = page.get_by_role(
        "link",
        name="Open phone settings",
    )
    phone_settings_link.wait_for(state="visible")
    if phone_settings_link.get_attribute("href") != "/app/settings?edit=phone#parents":
        raise AssertionError("Phone settings link does not open the phone editor")
    center_element(page, "#kept-worksheet-heading")
    screenshots.append(
        capture_viewport_screenshot(
            page,
            f"04-kept-no-phone-after-click-{viewport_name}",
            viewport,
        ),
    )

    open_review_state(page, "failed")
    page.get_by_text("This is the goal for this lesson.").wait_for()
    page.get_by_text(
        "The lesson is saved. The worksheet did not finish.",
    ).wait_for()
    retry_button = page.get_by_role("button", name="Make the worksheet again")
    retry_button.wait_for(state="visible")
    center_element(page, "button:has-text('Make the worksheet again')")
    screenshots.append(
        capture_viewport_screenshot(
            page,
            f"05-failed-retry-{viewport_name}",
            viewport,
        ),
    )
    retry_button.click()
    page.get_by_text(
        "The worksheet did not start. Your lesson is still saved.",
    ).wait_for(state="visible")
    screenshots.append(
        capture_viewport_screenshot(
            page,
            f"07-failed-worksheet-retry-error-{viewport_name}",
            viewport,
        ),
    )

    open_review_state(page, "failed-full")
    full_retry_button = page.get_by_role("button", name="Make the lesson again")
    full_retry_button.wait_for(state="visible")
    full_retry_button.click()
    page.get_by_text(
        "The lesson did not start. Your request is still saved.",
    ).wait_for(state="visible")
    center_element(page, "button:has-text('Make the lesson again')")
    screenshots.append(
        capture_viewport_screenshot(
            page,
            f"08-failed-lesson-retry-error-{viewport_name}",
            viewport,
        ),
    )

    open_review_state(page, "kept-phone")
    page.get_by_role("heading", name="Kept in Binder").wait_for(state="visible")
    page.get_by_role(
        "link",
        name="Message HOMA about this lesson",
    ).wait_for(state="visible")
    if (
        page.get_by_text(
            "Phone setup is optional. HOMA sends one research note by text each "
            "weekday morning.",
        ).count()
        != 0
    ):
        raise AssertionError("Phone-linked state still shows the phone prompt")
    if (
        page.get_by_role(
            "link",
            name="Open phone settings",
        ).count()
        != 0
    ):
        raise AssertionError("Phone-linked state still shows the phone setup link")
    center_element(page, "#kept-worksheet-heading")
    screenshots.append(
        capture_viewport_screenshot(
            page,
            f"06-kept-phone-linked-{viewport_name}",
            viewport,
        ),
    )

    open_review_state(page, "phone-settings")
    phone_input = page.locator("#my-phone")
    phone_input.wait_for(state="visible")
    if page.evaluate("document.activeElement?.id") != "my-phone":
        raise AssertionError("Phone settings did not focus the cell-number field")
    if phone_input.input_value() != "":
        raise AssertionError("No-phone settings fixture prefilled the phone field")
    center_element(page, "#parents")
    screenshots.append(
        capture_viewport_screenshot(
            page,
            f"09-phone-settings-editor-{viewport_name}",
            viewport,
        ),
    )

    viewport_requests = [
        entry for entry in request_log if entry["viewport"] == viewport_name
    ]
    if not any(entry["kind"] == "build" for entry in viewport_requests):
        raise AssertionError(f"No Build request captured for {viewport_name}")
    if not any(entry["kind"] == "keep" for entry in viewport_requests):
        raise AssertionError(f"No Keep request captured for {viewport_name}")
    retry_requests = [
        entry for entry in viewport_requests if entry["kind"] == "retry"
    ]
    if len(retry_requests) != 2:
        raise AssertionError(
            f"Expected two Retry requests for {viewport_name}, got "
            f"{len(retry_requests)}",
        )

    return screenshots


def main() -> None:
    SCREENSHOT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    request_log: list[dict[str, object]] = []
    console_errors: list[dict[str, str]] = []
    page_errors: list[dict[str, str]] = []
    screenshot_results: dict[str, list[dict[str, object]]] = {}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for viewport_name, viewport in VIEWPORTS.items():
            context = browser.new_context(
                viewport=viewport,
                device_scale_factor=1,
                reduced_motion="reduce",
            )
            page = context.new_page()

            def handle_api(route: Route) -> None:
                path = urlparse(route.request.url).path
                if path == "/api/map/subject-lesson/build":
                    body = parse_json_body(route)
                    if body != EXPECTED_BUILD_BODY:
                        raise AssertionError(f"Unexpected Build body: {body}")
                    request_log.append(
                        {
                            "viewport": viewport_name,
                            "kind": "build",
                            "body": body,
                        },
                    )
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps(
                            {
                                "ok": True,
                                "url": f"{REVIEW_PATH}?state=wait",
                            },
                        ),
                    )
                    return
                if path == "/api/map/subject-lesson/keep":
                    body = parse_json_body(route)
                    if body != EXPECTED_KEEP_BODY:
                        raise AssertionError(f"Unexpected Keep body: {body}")
                    request_log.append(
                        {
                            "viewport": viewport_name,
                            "kind": "keep",
                            "body": body,
                        },
                    )
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({"ok": True, "kept": True}),
                    )
                    return
                if path == "/api/map/subject-lesson/retry":
                    body = parse_json_body(route)
                    if body != EXPECTED_RETRY_BODY:
                        raise AssertionError(f"Unexpected Retry body: {body}")
                    request_log.append(
                        {
                            "viewport": viewport_name,
                            "kind": "retry",
                            "body": body,
                        },
                    )
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({"ok": False}),
                    )
                    return
                if path == "/api/map/subject-lesson/status":
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({"buildStatus": "running"}),
                    )
                    return
                route.fulfill(status=204, body="")

            page.route("**/api/**", handle_api)
            page.on(
                "console",
                lambda message, viewport_key=viewport_name: (
                    console_errors.append(
                        {"viewport": viewport_key, "message": message.text},
                    )
                    if message.type == "error"
                    else None
                ),
            )
            page.on(
                "pageerror",
                lambda error, viewport_key=viewport_name: page_errors.append(
                    {"viewport": viewport_key, "message": str(error)},
                ),
            )

            screenshot_results[viewport_name] = capture_retention_states(
                page,
                viewport_name,
                viewport,
                request_log,
            )
            context.close()
        browser.close()

    if console_errors:
        raise AssertionError(f"Browser console errors: {console_errors}")
    if page_errors:
        raise AssertionError(f"Browser page errors: {page_errors}")

    print(
        f"Captured {sum(len(items) for items in screenshot_results.values())} "
        f"screenshots with {len(request_log)} mocked action requests",
    )


if __name__ == "__main__":
    main()
