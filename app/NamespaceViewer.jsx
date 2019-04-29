import React, { useState } from "react";
import { useQuery } from "react-apollo-hooks";
import { useQueryParam, StringParam } from 'use-query-params';
import IntervalTree from "interval-tree-type";

import { namespaceRecipes as namespaceRecipesQuery } from "./graphql/namespaceRecipes.gql";

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
  const { loading, error, data } = useQuery(namespaceRecipesQuery);
  
  let recipes = null;
  let recipesByNamespace = new Map();
  
  let [selectedNamespace, setSelectedNamespace] = useQueryParam("namespace", StringParam);
  
  if (!selectedNamespace) {
    selectedNamespace = "<empty>";
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
  
  return (
    <div>
      <h1>
        Bucket Namespace{" "}
        <select value={selectedNamespace} onChange={ev => setSelectedNamespace(ev.target.value)}>
          <option value={undefined} key="undefined">---</option>
          {Array.from(recipesByNamespace.keys()).map(ns => <option key={ns} value={ns}>{ns}</option>)}
        </select>
      </h1>
      <NamespaceTable recipes={namespaceRecipes} />
    </div>
  );
}

function getFilter(recipe, type) {
  return recipe.currentRevision.filterObject.find(f => f.type == type);
}

function NamespaceTable({ recipes }) {
  recipes = [...recipes];  
  recipes.sort((a, b) => {
    const filterA = getFilter(a, "bucketSample");
    const filterB = getFilter(b, "bucketSample");
    return filterA.start - filterB.start;
  });
  
  let displayRows = [];
  
  let expectedStart = 0;
  let expectedTotal = recipes.length > 0 ? getFilter(recipes[0], "bucketSample").total: 1000;
  const takenBuckets = createIntervalTree([]);
  
  for (const recipe of recipes) {
    let bucketFilter = getFilter(recipe, "bucketSample");
    if (bucketFilter.start > expectedStart) {
      displayRows.push(
        <tr className="namespace-gap" key={`gap-${expectedStart}`}>
          <td>GAP</td>
          <td className="number">{expectedStart}</td>
          <td className="number">{bucketFilter.start - expectedStart}</td>
          <td className="number">{expectedTotal}</td>
          <td></td>
        </tr>
      );
    }
    
    if (bucketFilter.total != expectedTotal) {
      recipe._meta.totalMismatch = {expectedTotal};
    }
    
    recipe._meta.overlaps = [];
    tree.queryInterval(bucketFilter.start, bucketFilter.start + bucketFilter.count, overlap => {
      recipe._meta.overlaps.push(
    
    expectedStart = bucketFilter.start + bucketFilter.count;
    displayRows.push(<RecipeRow key={recipe.id} recipe={recipe} />);
  }
  
  if (expectedStart < expectedTotal) {
    displayRows.push(
      <tr className="namespace-gap" key="gap-end">
        <td>GAP</td>
        <td className="number">{expectedStart}</td>
        <td className="number">{expectedTotal - expectedStart}</td>
        <td className="number">{expectedTotal}</td>
        <td></td>
      </tr>
    );
  }
  
  return (
    <>
      <h2>{recipes.length} Recipe{recipes.length != 1 ? "s" : ""}</h2>
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
          {displayRows}
        </tbody>
      </table>
    </>
  );
}

function RecipeRow({ recipe }) {
  let bucketFilter = getFilter(recipe, "bucketSample");
  
  return (
    <tr>
      <td>
        <a
          href={`https://normandy.cdn.mozilla.net/api/v3/recipe/${recipe.id}/history/?format=json`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {recipe.id} - {recipe.currentRevision.name}
        </a>
      </td>
      <td className="number">
        {bucketFilter.start}
      </td>
      <td className="number">
        {bucketFilter.count}
      </td>
      <td className="number">
        {recipe._meta.totalMismatch &&
          <WarningIcon text={`Unexpected bucket total. Got ${bucketFilter.total} expected ${recipe._meta.totalMismatch.expectedTotal}.`}/>
        }
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

function WarningIcon ({text}) {
  return <span className="warning-icon" title={text} />;
}