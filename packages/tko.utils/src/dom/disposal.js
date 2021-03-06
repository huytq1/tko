//
// DOM node disposal
//
/* eslint no-cond-assign: 0 */
import * as domData from './data.js'
import {arrayRemoveItem} from '../array.js'
import {jQueryInstance} from '../jquery.js'

var domDataKey = domData.nextKey()
// Node types:
// 1: Element
// 8: Comment
// 9: Document
var cleanableNodeTypes = { 1: true, 8: true, 9: true }
var cleanableNodeTypesWithDescendants = { 1: true, 9: true }

function getDisposeCallbacksCollection (node, createIfNotFound) {
  var allDisposeCallbacks = domData.get(node, domDataKey)
  if ((allDisposeCallbacks === undefined) && createIfNotFound) {
    allDisposeCallbacks = []
    domData.set(node, domDataKey, allDisposeCallbacks)
  }
  return allDisposeCallbacks
}
function destroyCallbacksCollection (node) {
  domData.set(node, domDataKey, undefined)
}

function cleanSingleNode (node) {
    // Run all the dispose callbacks
  var callbacks = getDisposeCallbacksCollection(node, false)
  if (callbacks) {
    callbacks = callbacks.slice(0) // Clone, as the array may be modified during iteration (typically, callbacks will remove themselves)
    for (let i = 0; i < callbacks.length; i++) { callbacks[i](node) }
  }

    // Erase the DOM data
  domData.clear(node)

    // Perform cleanup needed by external libraries (currently only jQuery, but can be extended)
  for (let i = 0, j = otherNodeCleanerFunctions.length; i < j; ++i) {
    otherNodeCleanerFunctions[i](node)
  }

    // Clear any immediate-child comment nodes, as these wouldn't have been found by
    // node.getElementsByTagName('*') in cleanNode() (comment nodes aren't elements)
  if (cleanableNodeTypesWithDescendants[node.nodeType]) { cleanImmediateCommentTypeChildren(node) }
}

function cleanImmediateCommentTypeChildren (nodeWithChildren) {
  const children = nodeWithChildren.childNodes
  let cleanedNode
  for (let i = 0; i < children.length; ++i) {
    if (children[i].nodeType === 8) {
      cleanSingleNode(cleanedNode = children[i])
      if (children[i] !== cleanedNode) {
        throw Error('ko.cleanNode: An already cleaned node was removed from the document')
      }
    }
  }
}

// Exports
export function addDisposeCallback (node, callback) {
  if (typeof callback !== 'function') { throw new Error('Callback must be a function') }
  getDisposeCallbacksCollection(node, true).push(callback)
}

export function removeDisposeCallback (node, callback) {
  var callbacksCollection = getDisposeCallbacksCollection(node, false)
  if (callbacksCollection) {
    arrayRemoveItem(callbacksCollection, callback)
    if (callbacksCollection.length === 0) { destroyCallbacksCollection(node) }
  }
}

export function cleanNode (node) {
    // First clean this node, where applicable
  if (cleanableNodeTypes[node.nodeType]) {
    cleanSingleNode(node)

        // ... then its descendants, where applicable
    if (cleanableNodeTypesWithDescendants[node.nodeType]) {
      const descendants = node.getElementsByTagName('*')
      for (let i = 0; i < descendants.length; ++i) {
        let cleanedNode = descendants[i]
        cleanSingleNode(cleanedNode)
        if (descendants[i] !== cleanedNode) {
          throw Error('ko.cleanNode: An already cleaned node was removed from the document')
        }
      }
    }
  }
  return node
}

export function removeNode (node) {
  cleanNode(node)
  if (node.parentNode) { node.parentNode.removeChild(node) }
}

// Expose supplemental node cleaning functions.
export var otherNodeCleanerFunctions = []

// Special support for jQuery here because it's so commonly used.
// Many jQuery plugins (including jquery.tmpl) store data using jQuery's equivalent of domData
// so notify it to tear down any resources associated with the node & descendants here.
export function cleanjQueryData (node) {
  var jQueryCleanNodeFn = jQueryInstance
        ? jQueryInstance.cleanData : null

  if (jQueryCleanNodeFn) {
    jQueryCleanNodeFn([node])
  }
}

otherNodeCleanerFunctions.push(cleanjQueryData)
