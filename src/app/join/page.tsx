import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign up — Vyasa Health OS",
  description: "Sign up for Vyasa Health OS — digital prescriptions, real-time care coordination and a patient booking page for Indian doctors and hospitals.",
};

// The early-access form has moved to the app. /join now sends users straight
// to the Vyasa Health OS sign-up on app.vyasaa.com.
export default function JoinPage() {
  redirect("https://app.vyasaa.com/register");
}
