function Cards({ drugs }) {
  return (
    <div className="cards-container">
      {drugs.map((drug, index) => (
        <div className="card" key={index}>
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
  );
}

export default Cards;