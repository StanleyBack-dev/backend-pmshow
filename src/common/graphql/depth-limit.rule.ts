import {
  GraphQLError,
  Kind,
  type ASTVisitor,
  type FragmentDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
} from "graphql";

// Rejects queries nested deeper than `maxDepth` before they execute, so a
// crafted query can't fan out through relations (event → roster → members →
// events …) and exhaust the database.
export function depthLimitRule(maxDepth: number) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments = new Map<string, FragmentDefinitionNode>();
    for (const definition of context.getDocument().definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        fragments.set(definition.name.value, definition);
      }
    }

    const measure = (
      selectionSet: SelectionSetNode | undefined,
      depth: number,
      visited: Set<string>,
    ): number => {
      if (!selectionSet) return depth;
      let deepest = depth;
      for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
          // Introspection (__schema, __type, __typename) is not limited, so
          // the frontend codegen can still introspect in development.
          if (selection.name.value.startsWith("__")) continue;
          deepest = Math.max(
            deepest,
            measure(selection.selectionSet, depth + 1, visited),
          );
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
          deepest = Math.max(
            deepest,
            measure(selection.selectionSet, depth, visited),
          );
        } else {
          const name = selection.name.value;
          const fragment = fragments.get(name);
          if (!fragment || visited.has(name)) continue;
          deepest = Math.max(
            deepest,
            measure(fragment.selectionSet, depth, new Set(visited).add(name)),
          );
        }
      }
      return deepest;
    };

    return {
      OperationDefinition(node) {
        const depth = measure(node.selectionSet, 0, new Set());
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(
              `A consulta excede a profundidade máxima permitida (${maxDepth}).`,
              { nodes: [node], extensions: { code: "GRAPHQL_DEPTH_LIMIT" } },
            ),
          );
        }
      },
    };
  };
}
