import React, { useState } from "react";
import { useQuery } from "react-apollo-hooks";
import { useQueryParam, StringParam } from 'use-query-params';

import namespaceRecipesQuery from "./graphql/namespaceRecipes.graphql";
import NamespaceTable from "./NamespaceTable.jsx";
import { getBucketSample } from "./utils.jsx";

console.log({ namespaceRecipesQuery });

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
  
  try {
    rev.arguments = JSON.parse(rev.argumentsJson);
  } catch (err) {
    console.log("Warning: Revision doesn't have parsable arguments json", err, rev);
  }
}

export default function NamespaceViewer() {
  const { loading, error, data } = useQuery(namespaceRecipesQuery);
  let [selectedNamespace, setSelectedNamespace] = useQueryParam("namespace", StringParam);
  
  let recipes = null;
  let recipesByNamespace = new Map();
  
  if (!selectedNamespace) {
    selectedNamespace = '"global-v4"';
  }
  
  if (!error && !loading && data) {
    recipes = data.allRecipes
      .map(r => {
        patchRevision(r.approvedRevision);
        patchRevision(r.latestRevision);
        r.currentRevision = r.approvedRevision || r.latestRevision;
        r._meta = {};
        return r;
      })
      .filter(r => r.currentRevision.filterObject && getBucketSample(r))
    ;
    
    for (const recipe of recipes) {
      const bucketSample = getBucketSample(recipe);
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
  const namespaceNames = Array.from(recipesByNamespace.keys());
  namespaceNames.sort((a, b) => {
    if (a == "<empty>" && b != "<empty>") {
      return -1;
    } else if (a != "<empty>" && b == "<empty>") {
      return 1;
    } else {
      return recipesByNamespace.get(b).length - recipesByNamespace.get(a).length;
    }
  });
  
  if (loading) {
    return <h1>Loading namespaces...</h1>;
  }
  if (error) {
    return (
      <div>
        <h1>There was an error</h1>
        {error.toString()}
      </div>
    );
  }
  
  return (
    <div>
      <h1>
        Bucket Namespace{" "}
        <select value={selectedNamespace} onChange={ev => setSelectedNamespace(ev.target.value)}>
          <option value={undefined} key="undefined">---</option>
          {namespaceNames.map(ns => (
            <option key={ns} value={ns}>
              {ns} - {recipesByNamespace.get(ns).length} recipes
            </option>
          ))}
        </select>
      </h1>
      <NamespaceTable namespace={selectedNamespace} recipes={namespaceRecipes} />
    </div>
  );
}
