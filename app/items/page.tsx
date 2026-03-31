import Link from "next/link";

export const dynamic = "force-dynamic";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function ItemsPage() {
  await sleep(700);

  const renderId = Math.random().toString(36).slice(2, 8);
  const renderedAt = new Date().toISOString();

  console.log(`[items] render renderId=${renderId} renderedAt=${renderedAt}`);

  return (
    <main className="p-8 space-y-4">
      <h1>/items</h1>
      <p>
        This page uses <code>dynamic = &quot;force-dynamic&quot;</code>.
      </p>
      <p>
        render id: <strong id="render-id">{renderId}</strong>
      </p>
      <p>
        rendered at: <strong id="rendered-at">{renderedAt}</strong>
      </p>
      <Link
        id="to-import"
        href="/items/import"
        className="text-blue-600 underline"
      >
        Go to /items/import
      </Link>
    </main>
  );
}
