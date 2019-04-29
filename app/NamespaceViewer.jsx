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
  const takenBuckets = new IntervalTree();
  
  for (const recipe of recipes) {
    let bucketFilter = getFilter(recipe, "bucketSample");
    if (bucketFilter.start > expectedStart) {
      displayRows.push(
        <NamespaceGap
          key={`gap-${expectedStart}`}
          start={expectedStart}
          count={bucketFilter.start - expectedStart}
          total={expectedTotal}
        />
      );
    }
    
    if (bucketFilter.total != expectedTotal) {
      recipe._meta.totalMismatch = {expectedTotal};
    }
    
    // the IntervalRange class assumes fully inclusive ranges, instead of Normandy's half-inclusive ranges. 
    let intervalRange = [bucketFilter.start, bucketFilter.start + bucketFilter.count - 1];
    recipe._meta.overlaps = [];
    for (let overlap of takenBuckets.queryInterval(...intervalRange)) {
      recipe._meta.overlaps.push(overlap.value);
      overlap.value._meta.overlaps.push(recipe);
    }
    takenBuckets.insert(...intervalRange, recipe);
    
    expectedStart = bucketFilter.start + bucketFilter.count;
    displayRows.push(<RecipeRow key={recipe.id} recipe={recipe} />);
  }
  
  if (expectedStart < expectedTotal) {
    displayRows.push(
      <NamespaceGap
        key={`gap-end`}
        start={expectedStart}
        count={expectedTotal - expectedStart}
        total={expectedTotal}
      />
    );
  }
  
  const [newBucketSize, setNewBucketSize] = useState(10);
  let newStart = null;
  
  let collisions = Array.from(takenBuckets.queryInterval(0, newBucketSize - 1));
  if (collisions.length == 0) {
    newStart = 0;
  } else {
    for (const interval of takenBuckets.ascending()) {
      let potentialLow = interval.high + 1;
      let potentialHigh = potentialLow + newBucketSize - 1;
      if (potentialHigh >= expectedTotal) {
        continue;
      }
      console.log(`checking range [${potentialLow}, ${potentialHigh}]`);
      let collisions = Array.from(takenBuckets.queryInterval(potentialLow, potentialHigh));
      if (collisions.length == 0) {
        newStart = potentialLow;
        console.log(`Found range at ${newStart}`);
        break;
      } else {
        console.log(`${collisions.length} collisions:`, collisions);
      }
    }
  }
  
  return (
    <>
      <h2>New Bucket Range</h2>
      <label>
        Size of new bucket
        <input
          type="number"
          defaultValue={newBucketSize}
          onChange={ev => {
            const parsed = parseInt(ev.target.value);
            if (!isNaN(parsed)) {
              setNewBucketSize(parsed);
            }
          }}
        />
      </label>
      <div>
        {newStart == null
          ?  "No slot found"
          : `Slot starting at ${newStart} is available`
        }
      </div>
        
      <h2>{recipes.length} Existing Recipe{recipes.length != 1 ? "s" : ""}</h2>
      <table className="namespace-table">
        <thead>
          <tr>
            <th>Recipe</th>
            <th className="number">First<br/>Bucket</th>
            <th className="number">Num. of<br/>Buckets</th>
            <th className="number">Total<br/>Buckets</th>
            <th>
              Other filters <br>
              </br><small>Hover for details</small>
            </th>
            <th>Overlaps<br/>with</th>
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
      <td className="overlaps">
        {recipe._meta.overlaps.length == 0 && "-"}
        {recipe._meta.overlaps.map(overlappingRecipe => <span key={overlappingRecipe.id}>{overlappingRecipe.id}, </span>)}
      </td>
    </tr>
  );
}

function WarningIcon ({text}) {
  return <span className="warning-icon" title={text} />;
}

function NamespaceGap({ start, count, total }) {
  return (
    <tr className="namespace-gap" key="gap-end">
      <td>GAP</td>
      <td className="number">{start}</td>
      <td className="number">{count}</td>
      <td className="number">{total}</td>
      <td></td>
      <td></td>
    </tr>
  );
}