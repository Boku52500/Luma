import type { Metadata } from "next";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "წვდომა აკრძალულია",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <Container className="py-16">
          <h1 className="text-h2 text-text">წვდომა აკრძალულია</h1>
          <p className="text-body mt-3 max-w-lg text-text-muted">
            ამ გვერდის სანახავად საჭიროა ადმინისტრატორის უფლება. თუ თქვენ ხართ Luma-ს თანამშრომელი,
            სთხოვეთ ოპერაციების გუნდს ანგარიშის დაწინაურება.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/account">ანგარიშზე დაბრუნება</Button>
            <Button href="/" variant="secondary">
              მაღაზია
            </Button>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
