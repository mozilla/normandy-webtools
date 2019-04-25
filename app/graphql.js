import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloClient } from 'apollo-client';
import { ApolloLink } from 'apollo-link';
import { onError } from 'apollo-link-error';
import { HttpLink } from 'apollo-link-http';
import gql from "graphql-tag";

export const client = new ApolloClient({
  link: ApolloLink.from([
    onError(({ graphQLErrors, networkError }) => {
      if (graphQLErrors)
        graphQLErrors.map(({ message, locations, path }) =>
          console.log(
            `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
          ),
        );
      if (networkError) console.log(`[Network error]: ${networkError}`);
    }),
    new HttpLink({
      uri: 'https://normandy.cdn.mozilla.net/api/graphql/',
      useGETForQueries: true,
      headers: {
        "Content-Type": "text/plain",
      },
    }),
  ]),
  cache: new InMemoryCache()
});

export const GET_APPROVED_RECIPES = gql`
  query($recipeId: Int!) {
    recipe(id: $recipeId) {
      revisions {
        id
        created
        updated
        user {
          email
        }
        name
        action {
          name
        }
        argumentsJson
        extraFilterExpression
        filterObjectJson
        identiconSeed
      }
    }
  }
`