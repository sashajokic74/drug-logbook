import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 8000

app.use(cors())
app.use(express.json())

let drugs = [
  { id: 1, name: 'Fentanyl', size: '10 mL', concentration: '50 mcg/mL', quantity: 20 },
  { id: 2, name: 'Fentanyl', size: '2 mL', concentration: '50 mcg/mL', quantity: 20 },
  { id: 3, name: 'Morphine', size: '10 mL', concentration: '10 mg/mL', quantity: 20 },
  { id: 4, name: 'Remifentanil', size: '2 mg vial', concentration: '1 mg/mL after reconstitution', quantity: 20 },
  { id: 5, name: 'Oxycodone', size: '5 mL', concentration: '10 mg/mL', quantity: 10 },
  { id: 6, name: 'Midazolam', size: '5 mL', concentration: '2 mg/mL', quantity: 10 },
  { id: 7, name: 'Alfentanil', size: '2 mL', concentration: '500 mcg/mL', quantity: 10 },
  { id: 8, name: 'Preservative Free Morphine', size: '1 mL', concentration: '10 mg/mL', quantity: 10 }
]

app.get('/', (req, res) => {
  res.send('Drug Logbook API is running')
})

app.get('/api/drugs', (req, res) => {
  res.json(drugs)
})

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

app.delete('/api/drugs/:id', (req, res) => {
  drugs = drugs.filter(drug => drug.id !== Number(req.params.id))

  res.json({ message: 'Drug deleted successfully' })
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})