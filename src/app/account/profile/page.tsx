import type { Metadata } from "next";
import { ProfilePageClient } from "@/components/account/ProfilePageClient";

export const metadata: Metadata = {
  title: "პროფილი — Luma",
  description: "განაახლეთ საკონტაქტო ინფორმაცია.",
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
