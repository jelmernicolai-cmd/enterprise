'use client';

import { useState } from 'react';

export default function ContactFormEn() {
  const [status, setStatus] = useState<'idle'|'sending'|'ok'|'error'>('idle');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch('/api/contact', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)) });
      if (!res.ok) throw new Error('Failed');
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input name="name" required className="mt-1 w-full rounded border p-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input name="email" type="email" required className="mt-1 w-full rounded border p-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">Company</label>
        <input name="company" className="mt-1 w-full rounded border p-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">Message</label>
        <textarea name="message" rows={5} required className="mt-1 w-full rounded border p-2" />
      </div>
      <button type="submit" disabled={status==='sending'} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
        {status==='sending' ? 'Sending...' : 'Send'}
      </button>
      {status==='ok' && <p className="text-green-700">Thanks! We’ll be in touch.</p>}
      {status==='error' && <p className="text-red-700">Something went wrong. Please try again.</p>}
    </form>
  );
}
