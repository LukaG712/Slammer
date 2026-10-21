import { useState } from 'react'

function App() {
  const [services] = useState([
    { name: 'Greenie', url: 'http://localhost:8080', status: 'checking' },
    { name: 'Slinker', url: 'http://localhost:8000', status: 'checking' },
    { name: 'Trapper', url: 'http://localhost:3000', status: 'checking' },
    { name: 'Gobber', url: 'http://localhost:8085', status: 'checking' },
    { name: 'Sneaker', url: 'http://localhost:8086', status: 'checking' },
    { name: 'Hider', url: 'http://localhost:8087', status: 'checking' },
    { name: 'Poltergeist', url: 'http://localhost:8088', status: 'checking' },
    { name: 'Clairvoya', url: 'http://localhost:8089', status: 'checking' },
  ])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">👻 Slammer ~ Evershade Dashboard</h1>
          <p className="text-gray-400 mt-2">
            "Now that all the ghosts of Evershade Valley are under my control..." ~ King Boo
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-4">Service Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((service) => (
            <div key={service.name} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-lg">{service.name}</h3>
              <p className="text-sm text-gray-400">{service.url}</p>
              <span className="inline-block mt-2 px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                {service.status}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-gray-500">
          <p>Slammer is under construction ~ more features coming soon!</p>
        </div>
      </main>
    </div>
  )
}

export default App
