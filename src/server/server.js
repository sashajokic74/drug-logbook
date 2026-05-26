import express from 'express'
import cors from 'cors'

const app = express()

const PORT = 8000

app.use(cors())
app.use(express.json())

// Drug data
let drugs = [
  {
    id: 1,
    name: 'Fentanyl',
    size: '10 mL',
    concentration: '50 mcg/mL',
    quantity: 20
  },
  {
    id: 2,
    name: 'Morphine',
    size: '10 mL',
    concentration: '10 mg/mL',
    quantity: 15
  },
  {
    id: 3,
    name: 'Midazolam',
    size: '5 mL',
    concentration: '2 mg/mL',
    quantity: 10
  },
  {
    id: 4,
    name: 'Alfentanil',
    size: '2 mL',
    concentration: '500 mcg/mL',
    quantity: 8
  }
]

// Home route
app.get('/', (req, res) => {
  res.send('Drug Logbook API is running')
})

// Get all drugs
app.get('/api/drugs', (req, res) => {
  res.json(drugs)
})

// Get single drug
app.get('/api/drugs/:id', (req, res) => {
  const drug = drugs.find(
    drug => drug.id === Number(req.params.id)
  )

  if (!drug) {
    return res.status(404).json({
      message: 'Drug not found'
    })
  }

  res.json(drug)
})

// Add new drug
app.post('/api/drugs', (req, res) => {
  const newDrug = {
    id: drugs.length + 1,
    name: req.body.name,
    size: req.body.size,
    concentration: req.body.concentration,
    quantity: Number(req.body.quantity)
  }

  drugs.push(newDrug)

  res.status(201).json(newDrug)
})

// Delete drug
app.delete('/api/drugs/:id', (req, res) => {
  drugs = drugs.filter(
    drug => drug.id !== Number(req.params.id)
  )

  res.json({
    message: 'Drug deleted successfully'
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})