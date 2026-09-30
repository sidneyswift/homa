import { redirect } from "next/navigation";
import { getAppShellData } from "../../../../lib/app-data";
import { PageColumn } from "../../../../components/dashboard/page-column";
import { ProgramsView } from "./programs-view";

export default async function ProgramsPage() {
  const data = await getAppShellData();
  if (!data) redirect("/onboarding");
  return (
    <PageColumn>
      <ProgramsView
        childrenList={data.children.map((child) => ({
          id: child.id,
          name: child.name,
        }))}
      />
    </PageColumn>
  );
}
