import React from "react";
import IntervalTree from "interval-tree-type";
import { useState } from "react";

import { getBucketSample } from "./utils.jsx";

export default function NamespaceTable({ namespace, recipes }) {
  recipes = [...recipes];  
  recipes.sort((a, b) => {
    const filterA = getBucketSample(a);
    const filterB = getBucketSample(b);
    return filterA.start - filterB.start;
  });
  
  let displayRows = [];
  
  let expectedStart = 0;
  let expectedTotal = recipes.length > 0 ? getBucketSample(recipes[0]).total: 1000;
  const takenBuckets = new IntervalTree();
  
  for (const recipe of recipes) {
    let bucketFilter = getBucketSample(recipe);
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
      let collisions = Array.from(takenBuckets.queryInterval(potentialLow, potentialHigh));
      if (collisions.length == 0) {
        newStart = potentialLow;
        break;

      }
    }
  }
  
  const fraction = 10000 * newBucketSize / expectedTotal;
  const approximate = Math.round(fraction) != fraction;
  
  return (
    <>
      <h2>New Bucket Range</h2>
      <label>
        Number of buckets needed:{' '}
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
        This is a{approximate ? "n approximately" : ""} {Math.round(fraction) / 100}% sample.
      </div>
      <div>
        {newStart == null
          ?  "No slot found"
          : <>
            <span>Slot starting at {newStart} is available</span>
            <pre><code>{JSON.stringify({
              type: "bucketSample",
              start: newStart,
              count: newBucketSize,
              total: expectedTotal,
              input: (namespace && namespace != "<empty>")
                ? ["normandy.userId", namespace]
                : ["normandy.userId"],
            }, null, 4)}</code></pre>
          </>
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
  let bucketFilter = getBucketSample(recipe);
  
  return (
    <tr>
      <td>
        <RecipeEnabledState recipe={recipe} />
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

function RecipeEnabledState({ recipe }) {
  const rev = recipe.currentRevision;
  if (!rev.enabledState || !rev.enabledState.enabled) {
    return <span>Disabled</span>;
  }
  if (rev.arguments.isEnrollmentPaused) {
    return <span>Paused</span>;
  }
  return <span>Enabled</span>;
}
