import { useEffect, useState } from "react";
import ControlledDrugLogbook from "./components/ControlledDrugLogbook";

function App() {
  const [user, setUser] = useState(null);

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");

  const [error, setError] = useState("");


  useEffect(() => {

    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

  }, []);



  async function handleLogin(e) {

    e.preventDefault();

    setError("");


    try {

      const response = await fetch(
        "http://localhost:8000/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            username,
            password,
          }),
        }
      );


      const data = await response.json();


      if (!response.ok) {

        setError(
          data.message || "Login failed"
        );

        return;

      }



      localStorage.setItem(
        "token",
        data.token
      );


      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );


      setUser(data.user);


    } catch (error) {

      setError(
        "Server not running"
      );

    }

  }



  function logout() {

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);

  }




  if (!user) {

    return (

      <div className="app">


        <div
          className="card"
          style={{
            maxWidth: "420px",
            margin: "80px auto",
          }}
        >


          <h1>
            🔐 Staff Login
          </h1>



          <form onSubmit={handleLogin}>


            <input

              value={username}

              onChange={(e)=>
                setUsername(
                  e.target.value
                )
              }

              placeholder="Username"

            />



            <input

              type="password"

              value={password}

              onChange={(e)=>
                setPassword(
                  e.target.value
                )
              }

              placeholder="Password"

            />



            <button type="submit">

              Login

            </button>



          </form>



          {error && (

            <p style={{ color:"red" }}>

              {error}

            </p>

          )}



        </div>


      </div>

    );

  }




  return (

    <>

      <div
        style={{
          display:"flex",
          justifyContent:"flex-end",
          padding:"10px",
        }}
      >

        <button onClick={logout}>

          Logout ({user.username})

        </button>


      </div>



      <ControlledDrugLogbook />


    </>

  );

}


export default App;