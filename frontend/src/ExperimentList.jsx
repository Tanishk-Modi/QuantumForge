import { useState, useEffect } from "react";
import apiClient from "./api/client";

function ExperimentList() {
    
    const [experiments, setExperiments] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    async function fetchExperiments() {
        setIsLoading(true) 
        try {
            const response = await apiClient.get("/api/experiments")
            setExperiments(response.data)
        } catch (error) {
            console.error(error)
            setError("Failed to fetch experiments.")
        } finally {
            setIsLoading(false)
        }
    }

    // run callback after component has rendered
    useEffect(() => {
        fetchExperiments()
    }, [])

    return(
        <>
            {experiments.map((exp) => (
                <div key={exp.id}>
                    {exp.name}
                </div>
            ))}
        </>
    )

}

export default ExperimentList