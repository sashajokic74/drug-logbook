import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [drugs, setDrugs] = useState([])

  const [name, setName] = useState('')
  const [size, setSize] = useState('')
  const [concentration, setConcentration] = useState('')
  const [quantity, setQuantity] = useState('')

  useEffect(() => {
    fetchDrugs()
  }, [])

  const fetchDrugs = () => {
    fetch('http://localhost:8000/api/drugs')
      .then(response => response.json())
      .then(data => setDrugs(data))
      .catch(error => console.log(error))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    const newDrug = {
      name,
      size,
      concentration,
      quantity
    }

    fetch('http://localhost:8000/api/drugs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newDrug)
    })
      .then(response => response.json())
      .then(data => {
        setDrugs([...drugs, data])
        setName('')
        setSize('')
        setConcentration('')
        setQuantity('')
      })
      .catch(error => console.log(error))
  }

  return (
    <div className="App">
      <h1>Drug Logbook</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Drug name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="text"
          placeholder="Size"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />

        <input
          type="text"
          placeholder="Concentration"
          value={concentration}
          onChange={(e) => setConcentration(e.target.value)}
        />

        <input
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />

        <button type="submit">Add Drug</button>
      </form>

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
          <p><strong>Size:</strong> {drug.size}</p>
          <p><strong>Concentration:</strong> {drug.concentration}</p>
          <p><strong>Quantity:</strong> {drug.quantity}</p>
        </div>
      ))}
    </div>
  )
}

export default App