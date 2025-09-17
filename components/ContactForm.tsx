'use client';
import { useState } from 'react';

export default function ContactForm() {
  const [status, setStatus] = useState<'idle'|'sending'|'ok'|'error'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    <form onSubmit={onSubmit} className="grid gap-4 max-w-lg">
      <input name="name" required placeholder="Naam" className="border rounded px-3 py-2" />
      <input type="email" name="email" required placeholder="E-mail" className="border rounded px-3 py-2" />
      <textarea name="message" required placeholder="Uw bericht" className="border rounded px-3 py-2 h-32" />
      <button
        type="submit"
        disabled={status==='sending'}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-60"
      >
        {status==='sending' ? 'Verzenden...' : 'Verzenden'}
      </button>
      {status==='ok' && <p className="text-green-600 text-sm">Dank! We nemen snel contact op.</p>}
      {status==='error' && <p className="text-red-600 text-sm">Er ging iets mis, probeer later opnieuw.</p>}
    </form>
  );
}
