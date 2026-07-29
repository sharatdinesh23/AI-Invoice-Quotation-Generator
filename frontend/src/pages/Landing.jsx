// frontend/src/pages/Landing.jsx
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Navbar */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-blue-600">InvoicePro</h1>
        <div className="space-x-4">
          <Link to="/login" className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 font-medium">Log In</Link>
          <Link to="/login" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Get Started Free</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="text-center py-20 px-4">
        <h2 className="text-5xl font-extrabold mb-6 tracking-tight">
          Get Paid Faster, <span className="text-blue-600">Without the Hassle.</span>
        </h2>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
          The all-in-one invoicing platform for freelancers. Create professional invoices, automate recurring billing, and accept Razorpay payments instantly.
        </p>
        <Link to="/login" className="px-8 py-4 bg-blue-600 text-white rounded-xl text-lg font-bold hover:bg-blue-700 transition shadow-lg">
          Start Billing for Free →
        </Link>
      </header>

      {/* Features Grid */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-8">
          <FeatureCard icon="📄" title="Professional PDFs" desc="Auto-generated invoices with your logo, GSTIN, and custom branding." />
          <FeatureCard icon="🔄" title="Recurring Billing" desc="Set it and forget it. Automatically generate and send invoices weekly or monthly." />
          <FeatureCard icon="💳" title="Instant Payments" desc="Clients pay directly via Razorpay. No more chasing late payments." />
        </div>
      </section>

      {/* Pricing / Monetization Teaser */}
      <section className="py-16 max-w-4xl mx-auto px-4 text-center">
        <h3 className="text-3xl font-bold mb-8">Simple, Transparent Pricing</h3>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-8 border border-gray-200 dark:border-gray-700 rounded-2xl">
            <h4 className="text-xl font-bold mb-2">Starter</h4>
            <p className="text-4xl font-extrabold mb-4">Free</p>
            <ul className="text-left space-y-2 text-gray-600 dark:text-gray-400 mb-6">
              <li>✅ Up to 5 Invoices / month</li>
              <li>✅ Basic PDF Generation</li>
              <li>✅ Razorpay Integration</li>
            </ul>
            <Link to="/login" className="block w-full py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium">Sign Up Free</Link>
          </div>
          <div className="p-8 border-2 border-blue-600 rounded-2xl relative bg-blue-50/50 dark:bg-blue-900/10">
            <span className="absolute top-0 right-0 bg-blue-600 text-white text-xs px-3 py-1 rounded-bl-lg rounded-tr-lg font-bold">POPULAR</span>
            <h4 className="text-xl font-bold mb-2">Professional</h4>
            <p className="text-4xl font-extrabold mb-4">₹499<span className="text-lg font-normal text-gray-500">/mo</span></p>
            <ul className="text-left space-y-2 text-gray-600 dark:text-gray-400 mb-6">
              <li>✅ Unlimited Invoices</li>
              <li>✅ Recurring Billing Automation</li>
              <li>✅ Gmail Direct Sending</li>
              <li>✅ Remove "InvoicePro" Branding</li>
            </ul>
            <Link to="/login" className="block w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Upgrade to Pro</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-gray-500 text-sm border-t border-gray-200 dark:border-gray-800">
        © 2026 InvoicePro. Built for freelancers, by freelancers.
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="p-6 bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h4 className="text-xl font-bold mb-2">{title}</h4>
      <p className="text-gray-600 dark:text-gray-300">{desc}</p>
    </div>
  )
}