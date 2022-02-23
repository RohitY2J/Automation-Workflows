import React from 'react';
import './App.css';
import {useState} from "react"
import Axios from "axios";


function App() {
    const [ip, setIp] = useState("")
    const [site, setSite] = useState("")

    const block = () => {
        console.log(ip)
        Axios.post("http://localhost:3001/create", {ip: ip, site: site}).then(()=>{
            console.log("Successful Insertion")
        })
    }
    return (
        <div className="change">
            <h1> Lanturolal ko website. Hope this code works fine.</h1>
            <div>
                <input
                    type="text"
                    onChange={(event) => {
                        setIp(event.target.value)
                    }}/>
                &nbsp;&nbsp;
                <input
                    type="text"
                    onChange={(event) => {
                        setSite(event.target.value)
                    }}/>
                <button onClick={block}> Block</button>
            </div>
        </div>
    );
}

export default App;
