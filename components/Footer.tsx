export default function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-600 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} PharmGtN</p>
        <p>Gross-to-Net optimalisatie • Datagedreven • Privacy by design</p>
      </div>
    </footer>
  );
}
