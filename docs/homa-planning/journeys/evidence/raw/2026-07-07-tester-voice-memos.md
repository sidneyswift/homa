# Evidence · tester voice memos · 2026-07-07

> Historical raw evidence. The transcripts are preserved verbatim from the
> 2026-07-07 transcription pass. Editorial metadata and related-work locators
> may be corrected, but this file does not describe current product status.

Fourteen voice memos recorded 2026-07-07 between 15:32 and 16:39 by a pilot
tester (a homeschooling mom) walking through the product and thinking out loud
about marketing. The source audio was intentionally not committed. Fourteen
`.m4a` files totaling about 11 minutes were transcribed 2026-07-07 with Whisper
via fal.ai (`fal-ai/whisper`).

Handling notes:

- Transcripts are verbatim ASR output, never rewritten. Load-bearing
  mishearings, flagged here instead of edited inline: "the little homo guy" is
  the Homa mark; "Talk to Home" referred to a now-removed home surface;
  "teach tap done" referred to a landing section present during the test;
  "on the back and eventually" is "on the back end eventually"; "when they
  download HOMA at night" means downloading the day to Homa; "Alyssa" is most
  likely Alessa (planning-doc spelling); "her son, story is three" in memo 10
  is garbled, likely "[her son] is three".
- Kids' names are redacted to roles per the family-data law (repo AGENTS.md,
  marketing law 3); redactions appear as bracketed roles. Maya, Eli, and Nora
  in memo 6 stay as spoken: those are the fixture kids on the landing page
  (`apps/web/components/marketing/thread/vignettes.tsx`), not real children.
- Formal §5.2 coding (persona/assumption tags) is deferred until the M0-07
  evidence scaffold lands; the index below is the working summary.

## Index

Product asks:

| Memo | Ask | Surface / related work |
|---|---|---|
| 1 | Visible thinking state (notes, "building something out"); the Homa mark could bounce while thinking, go static once sent | Chat; MJ-06 generation status |
| 2 | Top-left wordmark should navigate home; she keeps tapping it despite the home button on the right | App header nav |
| 3 | Per-kid chats from the family view; visible chat history so she can rerun a past build "with this tweak" | Home + chat; M1-02 conversation persistence |
| 4 | Worksheet art directions: public-domain artwork, clip art, black-and-white, real stock photos | Worksheet generation; M2-05 artifact library |
| 5 | Explain how the points are created; short "how to talk to Homa" tutorial; praise for the landing thread squiggle | Report + onboarding; M2-03; `/onboarding/method` exists but is not discoverable enough |
| 6 | Kid card lists subjects already discussed; tap kid + subject to open a pre-scoped chat, "shortcuts from point A to point B" | Home; J2 daily loop |
| 7 | Calendar of done/planned work, Homa inserts the worksheets, photos of the day's work catalogued per day, retroactive edits, portfolio accretes | J2/J4; M2-04 observations; M3-11 efficacy loop |
| 13 | Parent-facing closing line belongs in chat; the sheet's message should speak to the child; keep "Made with Homa for [name]"; add a Homa watermark for provenance | Current printable path: `apps/web/agent/tools/create_printable.ts`; D7 footer attribution |
| 14 | The loop in her words: assess once, photograph work through the week, nightly download to Homa, evidence-based adjustment, "solid metrics to go after" | M3-11 efficacy loop |

Copy flag (founder call, nothing changed yet):

| Memo | Flag | Surface |
|---|---|---|
| 8 | "It ran our homeschool first" read as Homa in control rather than assisting | Historical landing-copy flag; current copy must be re-located before reuse |

Marketing ideas (all in `marketing/signals/`; memos 8 and 14 also yielded one signal each):

| Memo | Idea |
|---|---|
| 9 | "How do you Homa?" reader-stories blog series |
| 10 | Testimonial anatomy: who, where, kid age, how long with Homa, artifacts; plus local chapters as the testimonial's doorway |
| 11 | Ask trial families for artifacts + feedback + a signed release |
| 12 | Testimonials carry a photo and social handles; cross-post so discovery loops back |

## Transcripts

### Memo 1 · 15:32 · thinking state (42s) · AUDIO-2026-07-07-15-32-41.m4a

> I would love while it's thinking to see something that says that it's
> thinking like taking notes, building something out because the page is just
> blank, which gives you like a little bit of panic. Like, oh my gosh, is it
> working? Is it not working? I think having something like that, or maybe
> even seeing like the little homo guy kind of like bouncing around, like
> she's bouncing around and then her. response, you know, she could be
> bouncing around while she's thinking, and then she's static once the
> submission has been sent.

### Memo 2 · 15:36 · wordmark as home link (14s) · AUDIO-2026-07-07-15-36-20.m4a

> I would love if I could press on the upper left area of Homa. And I know
> that there's a home button all the way to the right that I've already seen.
> But I keep wanting to press up on the left at Homa to go home.

### Memo 3 · 15:37 · per-kid chats, chat history (56s) · AUDIO-2026-07-07-15-37-52.m4a

> When I go back to home and I see my family, I wish that I could just click
> on my kid and then have a chat just based on them, as opposed to just having
> a whole family chat where they're all involved. It would kind of help me
> organize in my mind what I've done. And then I'm going to press Talk to Home
> again. I also can't see any of my previous chats. And I feel like that would
> be helpful because that way I can see what I've built or what works and go
> back into that chat and be like, can you make me this exact same thing again,
> but just with this tweak as opposed to having to start a completely new chat
> for it again.

### Memo 4 · 15:39 · worksheet art directions (38s) · AUDIO-2026-07-07-15-39-32.m4a

> Okay, for templates. One, using artwork that is already, the copyright is
> ended, whatever, free to use. Two, using clip art. Three, black and white.
> And four, using actual live images. What's that website where you can get
> just like pictures that people have taken? What is that? Oh, like stock,
> like stock images, stock.

### Memo 5 · 16:02 · points explained, talk-to-Homa tutorial (29s) · AUDIO-2026-07-07-16-02-02.m4a

> Also, can we explain the point system somewhere? Like how are the points
> created? What happens? You might also want a short tutorial about how to
> talk to Homa to get the best results. Ooh, I like this. I just started
> scrolling down and there's like an interactive swirly-dirly on the side. I
> like that.

### Memo 6 · 16:03 · kid + subject shortcuts into chat (51s) · AUDIO-2026-07-07-16-03-07.m4a

> On the home page, there's a square that says Maya, Eli, Nora, and then it
> has the subject at the bottom. That would be really nice when you're in HOMA
> and asking questions. It could be like, Maya, and then list the subjects
> that you talked about already so that you could click. So I could be like,
> Maya, and then click Math. And then it would say, let's talk, or what do you
> want to ask? and start your chat with Homa, and then Homa would already know
> that we're going to be talking about math and could already be looking
> through everything that we've done about math. Just to create these
> shortcuts to help the user get from point A to point B faster.

### Memo 7 · 16:05 · calendar, photo capture, portfolio (82s) · AUDIO-2026-07-07-16-05-48.m4a

> I'm also assuming that the teach tap done is something that's gonna come up
> on the back and eventually, but I really liked that so that I can check off
> what we did and also maybe add in our schedule. Actually, what I would like
> is a way for me, almost like a calendar for me to put in what we've done and
> then Homa inserts. Or like what we're planning to do, however, people choose
> to do it, but then Homa inserts the worksheets based on what we talked about
> so that I can check off that we did it and then that way, when I talk to
> Homa at the end of the day and tell her everything, when it take pictures of
> the worksheets or whatever, it's all cataloged in that day or I can go back
> to the day and add things retroactively. I think would be great because I
> know Alyssa talks to Homa at night and I really think for a lot of things,
> we're gonna have to take pictures of our child's work and then that will
> help with the portfolio because it'll just be building it as the days go on
> and it can include what we're doing already on our end as a homeschooling
> parent.

### Memo 8 · 16:12 · copy flag: "ran our homeschool" (24s) · AUDIO-2026-07-07-16-12-55.m4a

> I think we need to rejigger that it ran our homeschool first because it
> makes it sound like Homa's in control instead of Homa is assisting. I'm
> still reading.

### Memo 9 · 16:18 · "How do you Homa?" series (33s) · AUDIO-2026-07-07-16-18-22.m4a

> For the blog, we could also have a series of like, how do you HOMA? And go
> through different people and how they've used HOMA and how it's helped them
> and giving examples, showing examples of different things that HOMA has
> created for them. And what changes they've seen in their homeschool day to
> day and over time with implementing HOMA. into their life.

### Memo 10 · 16:20 · testimonial anatomy, local chapters (46s) · AUDIO-2026-07-07-16-20-17.m4a

> So kind of like testimonials, but it could include like, Alyssa from DC, her
> son, story is three. This is how she's used HOMA. This is what she said
> about it. These are examples of what HOMA made for her. And she's been using
> HOMA for three weeks. This person's been using her for three months. Yeah,
> and then having a section, Where you can be like, you know, Alyssa's in
> D.C. Check out our D.C. HOMA chapter to link up with other people that are
> using HOMA. I mean, something more catchy than that, obviously, but you get
> the idea.

### Memo 11 · 16:21 · trial feedback + signed release (64s) · AUDIO-2026-07-07-16-21-35.m4a

> So when we give out the free trials, we want to ask them to send us examples
> of things that worked well for them, that Homa created, feedback on what
> worked, what didn't, and how Homa has affected their day-to-day. And we need
> to make sure that they sign a release saying that we can, use that review on
> the website, either as the testimonial section or also blog sections. And if
> we can get a picture either like, wow, que bonito. Oh, lo siento. [her
> kid]'s painting me. OK. And that's not true.

### Memo 12 · 16:22 · photos, social handles, cross-post loop (15s) · AUDIO-2026-07-07-16-22-31.m4a

> Oh, a photo of them and their social handles. That way people can go on
> their socials and see how they're using Homa too. And then we can also cross
> put all of that on socials as well. And that leads back to Homa.

### Memo 13 · 16:28 · worksheet closing lines, watermark (79s) · AUDIO-2026-07-07-16-28-33.m4a

> When I do, when I make a worksheet at the bottom, it has a message for me
> and a message for my child. I think that that message for me, I would like
> in the chat and I would like that message that's here to be for my child.
> Sorry, there's not a message for my child right now. It just says, made with
> Homa for [her daughter]. But here it says, two weeks off is nothing for
> Poseidon, and it's nothing for her either. Every Trident earned today is
> proof she's back on track. And I think I would want to be able to say that
> to [her daughter]. Like, two weeks off is nothing for Poseidon, and it's
> nothing for you either. Every Trident you've earned today is proof you're
> getting back on track. So I really like that, but I would want it to be
> geared to the child as something that I can say to them. And I love the made
> with Homa for [her daughter], I think is really cute. I think it would be
> nice to have a little image of Homa at the bottom as like a watermark or
> whatever. So that It's easy to tell when something was made by Homa or not.

### Memo 14 · 16:39 · the loop in her words (70s) · AUDIO-2026-07-07-16-39-51.m4a

> Say it again. OK, we're creating a timeline for our child. And also, we're
> able to pinpoint and recognize bottlenecks through the system of taking the
> initial questionnaire, and that's the mom noticing that. And for older kids,
> the kids taking it, possibly, or taking sort of an assessment. And then from
> there, instead of reassessing constantly, it is a matter of that mother and
> her responsibility to take photos of the child's work throughout the day.
> Yep, throughout the week, yeah. And then that way, when they download HOMA
> at night, about everything that happened during the day, she can compile how
> to adjust things based on the evidence of what was submitted through photo
> and what the mother or the home educator is saying and can really create
> some solid metrics to go after.
