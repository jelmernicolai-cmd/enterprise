import { redirect } from "next/navigation";

export default function LegacyConsistencyUploadRedirect() {
  redirect("/app/upload");
}
