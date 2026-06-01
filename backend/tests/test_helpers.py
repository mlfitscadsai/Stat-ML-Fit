from helpers.ssh_client import get_ssh_client
from helpers.commnad_write import CommandWriter

def test_get_ssh_client(mocker):
    mocker.patch.dict(
        'os.environ',
        {'HPC_HOST': 'hpc.example.edu', 'HPC_USER': 'user', 'HPC_PASSWORD': 'secret'},
        clear=False,
    )
    mocker.patch('helpers.ssh_client.socket.getaddrinfo', return_value=[(2, 1, 6, '', ('1.2.3.4', 22))])
    mock_ssh = mocker.patch('paramiko.SSHClient')
    mock_instance = mock_ssh.return_value

    client = get_ssh_client()
    
    assert client == mock_instance
    mock_instance.set_missing_host_key_policy.assert_called_once()
    mock_instance.connect.assert_called_once()

def test_command_writer():
    writer = CommandWriter()
    request = {}
    parameters = {
        "target": "target_col",
        "seed": 42,
        "lda_type": 1,
        "priors": "0.4,0.6",
        "explain": True,
        "filename": "uploaded.csv",
    }
    
    cmd = writer.get_command(parameters)
    
    assert "target_col" in cmd
    assert "42" in cmd
    assert "priors" in cmd
    assert 'pd.read_csv("uploaded.csv")' in cmd
    assert 'pd.read_csv("main.csv")' not in cmd
