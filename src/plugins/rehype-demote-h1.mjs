/**
 * WordPress posts sometimes carry an <h1> inside the body, which would give the
 * rendered page a second <h1> next to the post title. Demote those to <h2> —
 * heading levels only, never the text.
 */
export default function rehypeDemoteH1() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'h1') node.tagName = 'h2';
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}
