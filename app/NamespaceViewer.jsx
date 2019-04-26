import React from "react";
import { useQuery } from "react-apollo-hooks";

import { GET_APPROVED_RECIPES } from "./graphql.js";

export default function NamespaceViewer() {
  const { loading, error, data } = useQuery(GET_APPROVED_RECIPES);
  
  let recipes = null;
  let recipesByNamespace = new Map();
  
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
      const namespace = bucketSample.input
        .filter(i => i != "normandy.userId")
        .map(i => i == "normandy.recipe.id" ? recipe.id : i)
        .join("::");
      if (!recipesByNamespace.has(namespace)) {
        recipesByNamespace.set(namespace, []);
      }
      recipesByNamespace.get(namespace).push(recipe);
    }
  }
  
  
  return (
    <div>
      <h1>Namespaces:</h1>
      <ul>
        {Array.from(recipesByNamespace.keys()).map(ns => <li>{JSON.stringify(ns)}</li>)}
      </ul>
    </div>
  );
}