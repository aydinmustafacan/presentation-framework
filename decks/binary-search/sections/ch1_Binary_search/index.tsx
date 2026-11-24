import { Slide, Grid, Card, Callout } from '@framework';

export default function Cover() {
  return (
    <Slide lead="Guess a number between 1 and 1,000,000 and I'll find it in 20 yes/no questions. That trick is binary search — and it only works because the data is sorted.">
      <Grid cols={3}>
        <Card title="Linear search" tone="red">Check every element: up to <b>n</b> comparisons.</Card>
        <Card title="Binary search" tone="green">Halve the range each time: about <b>log₂ n</b> comparisons.</Card>
        <Card title="1,000,000 items" tone="accent">1,000,000 comparisons vs <b>20</b>.</Card>
      </Grid>
      <Callout title="The catch">The input must be sorted, and you need random access to the middle element.</Callout>
    </Slide>
  );
}
