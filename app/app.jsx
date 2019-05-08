import React from "react";
import ReactDOM from "react-dom";
import { ApolloProvider } from 'react-apollo-hooks';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';

import { client as graphqlClient } from "./graphql/index.js";
import NamespacesPage from "./NamespacesPage.jsx";

ReactDOM.render(
  <ApolloProvider client={graphqlClient}>
    <Router>
      <QueryParamProvider ReactRouterRoute={Route}>
        <Route path="/">
          <NamespacesPage />
        </Route>
      </QueryParamProvider>
    </Router>
  </ApolloProvider>,
  document.querySelector('#main'),
);