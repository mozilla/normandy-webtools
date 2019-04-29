import React, { useState } from "react";
import { useQuery } from "react-apollo-hooks";
import { useQueryParam, StringParam } from 'use-query-params';

import { GET_APPROVED_RECIPES } from "./graphql.js";

function patchRevision(rev) {
  if (!rev) {
    return;
  }
  try {
    if (rev.filterObjectJson) {
      rev.filterObject = JSON.parse(rev.filterObjectJson);
    }
  } catch (err) {
    console.log("Warning: Revision doesn't have parsable filter object json", err, rev);
  }
}

export default function NamespaceViewer() {
  const { loading, error, data } = useQuery(GET_APPROVED_RECIPES);
  
  let recipes = null;
  let recipesByNamespace = new Map();
  
  let [selectedNamespace, setSelectedNamespace] = useQueryParam("namespace", StringParam);
  
  if (!selectedNamespace) {
    selectedNamespace = "<empty>";
  }
  
  if (!error && !loading && data) {
    console.log(data);
    recipes = data.allRecipes
      .map(r => {
        patchRevision(r.approvedRevision);
        patchRevision(r.latestRevision);
        r.currentRevision = r.approvedRevision || r.latestRevision;
        return r;
      })
      .filter(r => r.currentRevision.filterObject && getFilter(r, "bucketSample"))
    ;
    
    for (const recipe of recipes) {
      const bucketSample = getFilter(recipe, "bucketSample");
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
  }
  
  const namespaceRecipes = recipesByNamespace.get(selectedNamespace) || [];
  
  namespaceRecipes.sort((a, b) => {
    const filterA = getFilter(a, "bucketSample");
    const filterB = getFilter(b, "bucketSample");
    return filterA.start - filterB.start;
  });
  
  return (
    <div>
      <h1>
        Bucket Namespace{" "}
        <select value={selectedNamespace} onChange={ev => setSelectedNamespace(ev.target.value)}>
          <option value={undefined} key="undefined">---</option>
          {Array.from(recipesByNamespace.keys()).map(ns => <option key={ns} value={ns}>{ns}</option>)}
        </select>
      </h1>
      <h2>{namespaceRecipes.length} Recipe{namespaceRecipes.length != 1 ? "s" : ""}</h2>
      <table className="namespace-table">
        <thead>
          <tr>
            <th>Recipe</th>
            <th className="number">First Bucket</th>
            <th className="number">Number of Buckets</th>
            <th className="number">Total Buckets</th>
            <th>
              Other filters <br>
              </br><small>Hover for details</small>
            </th>
          </tr>
        </thead>
        <tbody>
          {namespaceRecipes.map(recipe => <RecipeRow key={recipe.id} recipe={recipe} />)}
        </tbody>
      </table>
    </div>
  );
}

function getFilter(recipe, type) {
  return recipe.currentRevision.filterObject.find(f => f.type == type);
}

function RecipeRow({ recipe }) {
  let bucketFilter = getFilter(recipe, "bucketSample");
  
  return (
    <tr>
      <td>
        <a href="
          {recipe.id} - {recipe.currentRevision.name}
      </td>
      <td className="number">
        {bucketFilter.start}
      </td>
      <td className="number">
        {bucketFilter.count}
      </td>
      <td className="number">
        {bucketFilter.total}
      </td>
      <td>
        <ul className="filter-list">
          {recipe.currentRevision.filterObject
            .filter(filter => filter.type != "bucketSample")
            .map((filter, idx) => <li key={idx} title={JSON.stringify(filter, null, 2)}>{filter.type}</li>)
          }
          {(recipe.currentRevision.extraFilterExpression || "").trim() !== ""
            && <li key="extra" title={recipe.currentRevision.extraFilterExpression}>extra</li>
          }
        </ul>
      </td>
    </tr>
  );
}