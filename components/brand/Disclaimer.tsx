export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <footer className={`px-4 pb-8 pt-4 text-center text-caption text-muted ${className}`}>
      Concept prototype by Conrad Davis Jr. for a brightwheel take-home. Not an official brightwheel product. All schools, families and documents are fictional.
    </footer>
  );
}
