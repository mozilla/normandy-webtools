import React, { useState } from "react";
import { useQuery } from "react-apollo-hooks";

import { GET_APPROVED_RECIPES } from "./graphql.js";

export default function NamespaceViewer() {
  const { loading, error, data } = useQuery(GET_APPROVED_RECIPES);
  
  let recipes = null;
  let recipesByNamespace = new Map();
  
  const [selectedNamespace, setSelectedNamespace] = useState();

  
  if (!error && !loading && data) {
    console.log(data);
    recipes = data.allRecipes
      .filter(r => !!r.approvedRevision && r.approvedRevision.filterObjectJson)
      .map(r => {
        try {
          if (r.approvedRevision.filterObjectJson) {
            r.approvedRevision.filterObject = JSON.parse(r.approvedRevision.filterObjectJson);
          }
        } catch (err) {
          console.log("Warning: Recipe doesn't have parsable filter object json", err, r);
        }
        return r;
      })
      .filter(r => r.approvedRevision.filterObject && r.approvedRevision.filterObject.some(f => f.type == "bucketSample"))
    ;
    
    for (const recipe of recipes) {
      const bucketSample = recipe.approvedRevision.filterObject.find(f => f.type == "bucketSample");
      let namespace = bucketSample.input
        .filter(i => i != "normandy.userId")
        .map(i => i == "normandy.recipe.id" ? recipe.id : i)
        .join("::");
      if (namespace == "") {
        namespace = "<empty>";
      }
      if (!recipesByNamespace.has(namespace)) {
        recipesByNamespace.set(namespace, []);
      }
      recipesByNamespace.get(namespace).push(recipe);
    }
      
    if (selectedNamespace && data && !recipesByNamespace.has(selectedNamespace)) {
      //setSelectedNamespace(null);
    }
  }
  
  const namespaceRecipes = recipesByNamespace.get(selectedNamespace) || [];
  console.log(selectedNamespace
  
  return (
    <div>
      <h1>
        Namespace
        <select value={selectedNamespace}>
          {Array.from(recipesByNamespace.keys()).map(ns => <option key={ns} value={ns}>{ns}</option>)}
        </select>
      </h1>
      <h2>{namespaceRecipes.length} Recipe{namespaceRecipes.length != 1 ? "s" : ""}</h2>
      <ul>
        {namespaceRecipes.map(recipe => <li>{recipe.id} - {recipe.currentRevision.name}</li>)}
      </ul>
    </div>
  );
}