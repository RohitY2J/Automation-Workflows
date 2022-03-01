import React from 'react';
import './App.css';
import {useState} from "react"
import Axios from "axios";


function App(){
    const [ip, setIp] = useState("")
    const [site, setSite] = useState("")
    const [ipSiteList, setIpSiteList] = useState([])

    const block = () => {
        console.log(ip)
        Axios.post("http://localhost:3001/create", {ip: ip, site: site}).then(() => {
            console.log("Successful Insertion")
        })
    }
    const show = () => {
        console.log(ip)
        Axios.get("http://localhost:3001/show").then((response) => {
            setIpSiteList(response.data)
        })
    }

    return (
        <div className="change">
            <h1> Site Blocker</h1>
            <div>
                <input
                    type="text"
                    onChange={(event) => {
                        setIp(event.target.value)
                    }}/>

                <input
                    type="text"
                    onChange={(event) => {
                        setSite(event.target.value)
                    }}/>

            </div>
            <div>
                <button onClick={block}> Block </button>
            </div>
            <div>
                <button onClick={show}> Show </button>
            </div>
            {console.log(ipSiteList)}
            {ipSiteList.map((val,key)=>{

                return <div key={key}> {val.ip} {val.site} </div>
            })
            }


        </div>
    );
}

export default App;
