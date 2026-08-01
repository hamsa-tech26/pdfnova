export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="text-2xl font-extrabold text-blue-600">
          PDFNova
        </div>

        {/* Menu */}
        <div className="hidden gap-8 md:flex">
          <a href="#" className="text-gray-700 hover:text-blue-600">
            Tools
          </a>

          <a href="#" className="text-gray-700 hover:text-blue-600">
            AI PDF
          </a>

          <a href="#" className="text-gray-700 hover:text-blue-600">
            Pricing
          </a>

          <a href="#" className="text-gray-700 hover:text-blue-600">
            About
          </a>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          <button className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-100">
            Login
          </button>

          <button className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700">
            Sign Up
          </button>
        </div>
      </div>
    </nav>
  );
}