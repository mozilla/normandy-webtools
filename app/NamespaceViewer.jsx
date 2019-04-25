import React from "react";
import { useQuery } from "react-apollo-hooks";

import { GET_APPROVED_RECIPES } from "./graphql.js";

export default function NamespaceViewer() {
  const { loading, error, data } = useQuery(GET_APPROVED_RECIPES);
  
  let recipes = null
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
      });
  }
  
  return (<pre>
    <code>
      {recipes && JSON.stringify(recipes, null, 4)}
    </code>
  </pre>);
}