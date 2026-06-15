import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

function DrugRegister({ drug, onClose }) {

  console.log("REGISTER DRUG:", drug);

  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);

  const [form, setForm] = useState({
    patientName: "",
    hospitalNumber: "",

    ampoulesSupplied: "",
    ampoulesUsed: "",

    amountAdministered: "",
    administeredUnit: "mcg",

    amountWasted: "",
    wastedUnit: "mcg",

    checkerName: "",
    checkerSignature: "",
  });


  useEffect(() => {

    if (drug) {

      setBalance(drug.quantity);

      loadTransactions();

    }

  }, [drug]);



  if (!drug) {
    return null;
  }



  async function loadTransactions() {

    try {

      const token = localStorage.getItem("token");


      const response = await fetch(

        `${API_URL}/transactions/${drug.id}`,

        {

          headers: {

            Authorization: `Bearer ${token}`,

          },

        }

      );


      const data = await response.json();


if (Array.isArray(data)) {

  setTransactions(data);

} else {

  console.log("Transactions error:", data);

  setTransactions([]);

}


      if (data.length > 0) {

        setBalance(

          data[0].stockBalanceAfter

        );

      }



    } catch (error) {

      console.log(error);

    }

  }




  function updateForm(event) {

    setForm({

      ...form,

      [event.target.name]:
        event.target.value,

    });

  }




  async function saveEntry() {

    const token =
      localStorage.getItem("token");



    const response =
      await fetch(

        `${API_URL}/transactions`,

        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,

          },


          body: JSON.stringify({

            drugId: drug.id,

            drugName: drug.name,


            patientName:
              form.patientName,


            hospitalNumber:
              form.hospitalNumber,


            ampoulesSupplied:
              Number(form.ampoulesSupplied || 0),


            ampoulesUsed:
              Number(form.ampoulesUsed || 0),


            amountAdministered:
              Number(form.amountAdministered || 0),


            administeredUnit:
              form.administeredUnit,


            amountWasted:
              Number(form.amountWasted || 0),


            wastedUnit:
              form.wastedUnit,


            checkerName:
              form.checkerName,


            checkerSignature:
              form.checkerSignature,

          }),

        }

      );



    const result =
      await response.json();



    if (!response.ok) {

      alert(result.message);

      return;

    }



    setBalance(result.balance);



    setForm({

      patientName: "",
      hospitalNumber: "",

      ampoulesSupplied: "",
      ampoulesUsed: "",

      amountAdministered: "",
      administeredUnit: "mcg",

      amountWasted: "",
      wastedUnit: "mcg",

      checkerName: "",
      checkerSignature: "",

    });



    loadTransactions();

  }






  return (

    <div className="register-box">


      <button onClick={onClose}>

        ← Back to Drug Cards

      </button>



      <h2>

        📖 {drug.name} Register

      </h2>



      <p>

        {drug.concentration}

        {" | "}

        {drug.size}

      </p>




      <h2>

        Balance:

        {" "}

        {balance}

        {" "}

        ampoules

      </h2>






      <h3>Stock Movement</h3>



      <input

        name="ampoulesSupplied"

        placeholder="Ampoules supplied"

        value={form.ampoulesSupplied}

        onChange={updateForm}

      />



      <input

        name="ampoulesUsed"

        placeholder="Ampoules opened"

        value={form.ampoulesUsed}

        onChange={updateForm}

      />






      <h3>Patient</h3>



      <input

        name="patientName"

        placeholder="Patient name"

        value={form.patientName}

        onChange={updateForm}

      />



      <input

        name="hospitalNumber"

        placeholder="Hospital number"

        value={form.hospitalNumber}

        onChange={updateForm}

      />







      <h3>Dose</h3>



      <input

        name="amountAdministered"

        placeholder="Administered amount"

        value={form.amountAdministered}

        onChange={updateForm}

      />



      <select

        name="administeredUnit"

        value={form.administeredUnit}

        onChange={updateForm}

      >

        <option>mcg</option>

        <option>mg</option>

        <option>ml</option>

      </select>




      <input

        name="amountWasted"

        placeholder="Wasted amount"

        value={form.amountWasted}

        onChange={updateForm}

      />



      <select

        name="wastedUnit"

        value={form.wastedUnit}

        onChange={updateForm}

      >

        <option>mcg</option>

        <option>mg</option>

        <option>ml</option>

      </select>





      <h3>Checker</h3>



      <input

        name="checkerName"

        placeholder="Checker"

        value={form.checkerName}

        onChange={updateForm}

      />



      <input

        name="checkerSignature"

        placeholder="Checker signature"

        value={form.checkerSignature}

        onChange={updateForm}

      />



      <button onClick={saveEntry}>

        💾 Save Entry

      </button>






      <h3>Register Entries</h3>



      <table>


        <thead>

          <tr>

            <th>Date</th>

            <th>Patient</th>

            <th>Amp Used</th>

            <th>Given</th>

            <th>Waste</th>

            <th>Balance</th>

            <th>Staff</th>

            <th>Checker</th>

          </tr>

        </thead>



        <tbody>


          {transactions.map((entry) => (

            <tr key={entry.id}>


              <td>{entry.createdAt}</td>


              <td>{entry.patientName}</td>


              <td>

                {entry.ampoulesUsed}

              </td>


              <td>

                {entry.amountAdministered}

                {entry.administeredUnit}

              </td>


              <td>

                {entry.amountWasted}

                {entry.wastedUnit}

              </td>


              <td>

                {entry.stockBalanceAfter}

              </td>


              <td>

                {entry.staffFullName}

              </td>


              <td>

                {entry.checkerName}

              </td>


            </tr>

          ))}


        </tbody>


      </table>


    </div>

  );

}


export default DrugRegister;