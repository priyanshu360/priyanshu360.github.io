export function Footer() {
  return (
    <footer className="w-full max-w-[800px] flex flex-col items-center text-center mt-8 mb-8">
      <p>&copy; {new Date().getFullYear()} Priyanshu Rajput</p>
      <p className="text-content-muted text-sm">Made with React + Vite</p>
    </footer>
  )
}
