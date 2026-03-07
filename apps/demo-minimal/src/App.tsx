import { Cli, CliConfigProvider } from '@qodalis/react-cli';
import '@qodalis/cli/assets/cli-panel.css';

function App() {
    return (
        <CliConfigProvider>
            <Cli />
        </CliConfigProvider>
    );
}

export default App;
