import { useEffect, useState } from 'react'
import './App.css'

function App() {

  const [drugs, setDrugs] = useState([])

  useEffect(() => {
    fetch('http://localhost:8000/api/drugs')
      .then(response => response.json())
      .then(data => setDrugs(data))
      .catch(error => console.log(error))
  }, [])

  return (
    <div className="App">
      <h1>Drug Logbook</h1>

      {drugs.map(drug => (
        <div
          key={drug.id}
          style={{
            border: '1px solid gray',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '8px'
          }}
        >
          <h2>{drug.name}</h2>

          <p>
            <strong>Size:</strong> {drug.size}
          </p>

          <p>
            <strong>Concentration:</strong> {drug.concentration}
          </p>

          <p>
            <strong>Quantity:</strong> {drug.quantity}
          </p>
        </div>
      ))}
    </div>
  )
}

export default App