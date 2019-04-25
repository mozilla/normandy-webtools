import React from "react";
import ReactDOM from "react-dom";
import { ApolloProvider } from 'react-apollo-hooks';
import { BrowserRouter as Router, Route } from 'react-router-dom';

import { client as graphqlClient } from "./graphql.js";
import NamespaceViewer from "./NamespaceViewer.jsx";

ReactDOM.render(
  <ApolloProvider client={graphqlClient}>
    <Router>
      <Route path="/">
        <NamespaceViewer />
      </Route>
    </Router>
  </ApolloProvider>,
  document.querySelector('#main'),
);