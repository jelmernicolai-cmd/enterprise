import { redirect } from 'next/navigation';

export default function PortalAlias() {
  // Server Component → directe redirect is toegestaan
  redirect('/app');
}
