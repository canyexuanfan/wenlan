import { redirect } from "next/navigation";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InviteTokenPage({ params }: InvitePageProps) {
  const { token } = await params;
  redirect(`/register?token=${encodeURIComponent(token)}`);
}
