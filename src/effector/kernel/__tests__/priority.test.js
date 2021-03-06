//@flow

import invariant from 'invariant'
import {resolve} from 'path'
import {outputFile, readFile} from 'fs-extra'

import type {StepKind} from '../stepKind'
import * as kinds from '../stepKindTypes'

type TopoGraph = {[string]: string[], ...}

function createStepKindGraph(kinds: StepKind[]): TopoGraph {
  const graph: TopoGraph = {}
  for (const {tag} of kinds) {
    graph[tag] = []
  }
  for (const {tag, from, to} of kinds) {
    for (const kind of from) {
      graph[kind.tag].push(tag)
    }
    for (const kind of to) {
      graph[tag].push(kind.tag)
    }
  }
  const result: TopoGraph = {}
  for (const tag in graph) {
    result[tag] = [...new Set(graph[tag])]
  }
  return result
}
const generateSwitch = (order: string[]) => {
  const validType = order.map(tag => `'${tag}'`).join(' | ')
  const banner = `//@flow\n/* eslint-disable */\n`
  const warningMessage =
    '// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY'
  const typeDefinition = `export type PriorityTag = ${validType}`
  const functionHeader = `export const getPriority = (t: PriorityTag) => {`
  const footer = `    default: return -1\n  }\n}`
  const cases = order.map((tag, n) => `    case '${tag}': return ${n}`)
  return [
    warningMessage,
    banner,
    typeDefinition,
    functionHeader,
    `  switch(t) {`,
    ...cases,
    footer,
  ].join(`\n`)
}
it('generates runtime ordering', async() => {
  //$off
  const stepKindGraph = createStepKindGraph(Object.values(kinds))
  const sortedOrder = toposort(stepKindGraph)
  const switchFn = generateSwitch(sortedOrder)
  console.log(stepKindGraph)
  console.log(sortedOrder)
  console.log(switchFn)
  const getPriorityModulePath = resolve(__dirname, '..', 'getPriority.js')
  const currentSource = await readFile(getPriorityModulePath, 'utf8')
  if (currentSource !== switchFn) {
    await outputFile(getPriorityModulePath, switchFn)
  }
})

function toposort(graph: TopoGraph): string[] {
  const result = []
  const visited = {}
  const temp = {}
  for (const node in graph) {
    if (!visited[node] && !temp[node]) {
      topologicalSortHelper(node, visited, temp, graph, result)
    }
  }
  return result.reverse()

  function topologicalSortHelper(node, visited, temp, graph, result) {
    temp[node] = true
    const neighbors = graph[node]
    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i]
      invariant(!temp[n], 'found cycle in DAG')
      if (!visited[n]) {
        topologicalSortHelper(n, visited, temp, graph, result)
      }
    }
    temp[node] = false
    visited[node] = true
    result.push(node)
  }
}
