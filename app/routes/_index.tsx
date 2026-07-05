import type { Route } from "./+types/_index";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "example" },
    {
      content: "noindex, nofollow",
      name: "robots",
    },
  ];
};

export default function Home() {
  return (
    <>
      <section className="overflow-hidden">
        <h1>Hello</h1>
      </section>
    </>
  );
}
