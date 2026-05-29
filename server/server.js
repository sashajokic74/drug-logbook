import express from "express";
import cors from "cors";
import drugs from "./drugData.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/drugs", (req, res) => {
  return res.status(200).json(drugs);
});

app.post("/drugs", (req, res) => {
  const newDrug = {
    id: drugs.length + 1,
    name: req.body.name,
    class: req.body.class,
    stock: Number(req.body.stock),
    unit: req.body.unit,
  };

  drugs.push(newDrug);

  return res.status(201).json(newDrug);
});

app.put("/drugs/:id", (req, res) => {
  const drug = drugs.find((d) => d.id === Number(req.params.id));

  if (!drug) {
    return res.status(404).json({ message: "Drug not found" });
  }

  drug.name = req.body.name || drug.name;
  drug.class = req.body.class || drug.class;
  drug.stock =
    req.body.stock !== undefined ? Number(req.body.stock) : drug.stock;
  drug.unit = req.body.unit || drug.unit;

  return res.status(200).json(drug);
});

app.delete("/drugs/:id", (req, res) => {
  const index = drugs.findIndex((d) => d.id === Number(req.params.id));

  if (index === -1) {
    return res.status(404).json({ message: "Drug not found" });
  }

  drugs.splice(index, 1);

  return res.status(204).end();
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});