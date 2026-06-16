function Cards({ drugs }) {
  return (
    <div className="cards-container">
      {drugs.map((drug) => (
        <div className="card" key={drug.id}>
          <h2>{drug.name}</h2>

          <p>
            <strong>Size:</strong> {drug.size || "N/A"}
          </p>

          <p>
            <strong>Concentration:</strong> {drug.concentration || "N/A"}
          </p>

          <p>
            <strong>Quantity:</strong> {drug.quantity ?? drug.stock ?? 0}
          </p>
        </div>
      ))}
    </div>
  );
}

export default Cards;