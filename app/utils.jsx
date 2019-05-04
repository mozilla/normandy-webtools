export function WarningIcon ({text}) {
  return <span className="warning-icon" title={text} />;
}

export function getFilter(recipe, type) {
  return recipe.currentRevision.filterObject.find(f => f.type == type);
}

export function getBucketSample(recipe, expectedTotal=1000) {
  let bucketSample = getFilter(recipe, "bucketSample");
  if (!bucketSample) {
    // translate stable samples into bucket samples
    let stableSample = getFilter(recipe, "stableSample");
    if (stableSample) {
      bucketSample = {
        type: "bucketSample",
        start: 0,
        total: expectedTotal,
        count: stableSample.rate * expectedTotal,
        input: stableSample.input,
      };
    }
  }
  return bucketSample;
}