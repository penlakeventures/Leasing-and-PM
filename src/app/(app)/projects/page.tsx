import { prisma } from "@/lib/prisma";
import { Table, Th, Td, LinkButton, EmptyState } from "@/components/ui";
import Link from "next/link";

export default async function ProjectsPage() {
  const projects = await prisma.projectEntity.findMany({
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { units: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <LinkButton href="/projects/new">+ New project</LinkButton>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Internal name</Th>
            <Th>Website code</Th>
            <Th>Neighbourhood</Th>
            <Th>Address</Th>
            <Th>Occupancy</Th>
            <Th>Units</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {projects.map((p) => (
            <tr key={p.id} className="hover:bg-neutral-50">
              <Td>
                <Link
                  href={`/projects/${p.id}`}
                  className="font-medium text-neutral-900 underline"
                >
                  {p.internalName}
                </Link>
              </Td>
              <Td>{p.websiteCode}</Td>
              <Td>{p.neighbourhood}</Td>
              <Td>{p.address}</Td>
              <Td>{p.occupancyDate.toLocaleDateString()}</Td>
              <Td>{p._count.units}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {projects.length === 0 && (
        <EmptyState>No projects yet — add the first one.</EmptyState>
      )}
    </div>
  );
}
