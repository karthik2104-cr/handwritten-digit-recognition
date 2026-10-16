import { ErrorNotice } from "../components/ErrorNotice";
import { LoadingBlock } from "../components/LoadingBlock";
import { useAsync } from "../hooks/useAsync";
import { usePageTitle } from "../hooks/usePageTitle";
import { topConfusions } from "../lib/confusion";
import { formatPercent, modelLabel } from "../lib/format";
import { getConfusionMatrix, getModelInfo } from "../services/api";

const STEPS = [
  { title: "MNIST image", body: "Each example is a handwritten digit from 0 to 9, stored as a 28 by 28 grayscale picture." },
  { title: "784 features", body: "The grid is read left to right, top to bottom. Row one fills features 1–28, row two fills 29–56, and so on." },
  { title: "Normalization", body: "Intensities from 0–255 are divided by 255, so every feature lives between 0 and 1." },
  { title: "Classification", body: "The model scores all ten digits. The largest score is the prediction, and the scores are the class probabilities." },
];

export function AboutPage() {
  usePageTitle("About the Model");
  const info = useAsync(() => getModelInfo(), []);
  const matrix = useAsync(() => getConfusionMatrix(), []);
  const confusions = matrix.data ? topConfusions(matrix.data.matrix, matrix.data.labels).filter((item) => item.count > 0) : [];

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm leading-6 text-[var(--ns-muted)]">
        Handwritten digit recognition asks a model to read one character from 0 to 9. The input is an image. The output is one of ten classes.
      </p>

      <section className="grid gap-3 md:grid-cols-4">
        {STEPS.map((step, index) => (
          <article key={step.title} className="ns-card p-4">
            <p className="font-mono text-xs text-[var(--ns-accent-2)]">0{index + 1}</p>
            <h2 className="mt-2 font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ns-muted)]">{step.body}</p>
          </article>
        ))}
      </section>

      <section className="ns-card grid gap-4 p-5 sm:grid-cols-[120px_1fr] sm:items-center">
        <div className="grid h-28 w-28 grid-cols-4 gap-1 rounded-xl bg-black p-2" aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => (
            <span key={index} className="rounded-sm" style={{ background: `rgba(243,247,255,${index % 5 === 0 ? 0.9 : 0.15})` }} />
          ))}
        </div>
        <p className="text-sm leading-6 text-[var(--ns-muted)]">
          A 28×28 grid becomes a vector of 784 numbers. Position in that vector is the pixel’s place in the image, and the value is its brightness.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Article title="Why normalization matters">
          Logistic regression learns a weight for every pixel. If pixels stay on a 0–255 scale, a bright pixel has a much larger raw value than the optimizer expects, so training takes smaller or less stable steps. Dividing by 255 puts every pixel on the same range. A random forest splits on thresholds and is less sensitive to that scale, but the API still normalizes every drawing the same way so both models see one consistent input.
        </Article>
        <Article title="How the classifiers work">
          Logistic regression is the baseline. It treats the log-odds of each digit as a weighted sum of the 784 pixels, then moves those weights until the correct digit usually receives the highest probability. The deployed model is a random forest: many decision trees, each asking questions such as whether pixel 237 is brighter than 0.4. Trees see different bootstrap samples and random subsets of pixels, then the forest averages their votes. The reported confidence for a digit is the share of trees that chose it. That share is the model output. It should not be read as a calibrated probability.
        </Article>
        <Article title="How training and testing were separated">
          MNIST ships with 60,000 training images and 10,000 test images. This project keeps those pools separate. It draws a stratified sample from the training pool and a separate stratified sample from the test pool, using a configurable random seed. Stratification keeps every digit in both sets. The test images are used only to measure accuracy, precision, recall, F1, and the confusion matrix.
        </Article>
        <Article title="How to read the confusion matrix">
          Each row is the digit that was actually written. Each column is the digit the model predicted. The diagonal counts correct predictions. A cell off the diagonal counts a specific mistake. A large value in row 4, column 9 means many fours were called nines. Precision asks how often the model is right when it says a digit. Recall asks how many real examples of that digit the model found.
        </Article>
      </section>

      <section className="ns-card p-5">
        <h2 className="text-lg font-semibold">This experiment</h2>
        {info.loading ? <div className="mt-4"><LoadingBlock label="Loading model details" /></div> : null}
        {info.error ? <div className="mt-4"><ErrorNotice message={info.error} onRetry={info.reload} /></div> : null}
        {info.data ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3 text-sm leading-6 text-[var(--ns-muted)]">
              <p>
                The deployed model is {modelLabel(info.data.model_name)}, compared with a {modelLabel(info.data.baseline_model)} baseline.
                It was trained on {info.data.train_samples.toLocaleString()} images and evaluated on {info.data.test_samples.toLocaleString()} images
                with seed {info.data.random_seed}. Test accuracy is {formatPercent(info.data.metrics.accuracy, 2)}.
              </p>
              <p>{info.data.normalization}</p>
              <p>{info.data.official_split}</p>
              <ul className="list-disc space-y-1 pl-5">
                {info.data.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              {confusions.length > 0 ? (
                <p>
                  In this test subset, the most common mistakes are {confusions.map((item) => `${item.actual} read as ${item.predicted} (${item.count})`).join(", ")}.
                </p>
              ) : matrix.data ? (
                <p>The saved test subset does not contain an off-diagonal mistake.</p>
              ) : null}
            </div>
            <div>
              <h3 className="text-sm font-medium">Parameters and libraries</h3>
              <dl className="mt-3 space-y-2 text-sm">
                {Object.entries(info.data.parameters)
                  .filter(([key]) => ["n_estimators", "max_depth", "max_features", "min_samples_leaf", "C", "solver", "max_iter"].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 border-b border-[var(--ns-border)] pb-1">
                      <dt className="text-[var(--ns-muted)]">{key}</dt>
                      <dd className="font-mono">{String(value)}</dd>
                    </div>
                  ))}
                <div className="flex justify-between gap-4 border-b border-[var(--ns-border)] pb-1">
                  <dt className="text-[var(--ns-muted)]">Python</dt>
                  <dd className="font-mono">{info.data.python_version}</dd>
                </div>
                {Object.entries(info.data.library_versions).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4 border-b border-[var(--ns-border)] pb-1">
                    <dt className="text-[var(--ns-muted)]">{key}</dt>
                    <dd className="font-mono">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : null}
      </section>

      <section className="ns-card p-5">
        <h2 className="text-lg font-semibold">Limitations</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--ns-muted)]">
          <li>The published scores are for a stratified subset, so they are not the result of training on all 60,000 MNIST images.</li>
          <li>The model looks at individual pixels. It does not use the convolutional filters a neural network would use to recognize strokes in many positions.</li>
          <li>It expects one digit. It will not read multi-digit numbers, letters, or symbols.</li>
          <li>Very thin strokes, heavy rotation, extra decoration, or a photograph with shadows can move the image away from the MNIST style.</li>
          <li>Similar shapes are the usual failure mode. The evaluation page shows the pairs this particular model confuses.</li>
        </ul>
      </section>
    </div>
  );
}

function Article({ title, children }: { title: string; children: string }) {
  return (
    <article className="ns-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--ns-muted)]">{children}</p>
    </article>
  );
}
