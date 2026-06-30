import { useState } from 'react'
import CreateExperiment from './CreateExperiment'
import ExperimentList from './ExperimentList'

function App() {

  return (
    <>
      <h1>QForge</h1>  
      <CreateExperiment></CreateExperiment>
      <ExperimentList></ExperimentList>
    </>
  )
}

export default App